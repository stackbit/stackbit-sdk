import path from 'path';
import _ from 'lodash';
import { reducePromise } from '@stackbit/utils';
import estree from 'estree';

// not sure why, but using import acorn from 'acorn' doesn't work
const acorn = require('acorn');

import { FileBrowser } from './file-browser';

export async function findDirsWithPackageDependency(fileBrowser: FileBrowser, packageNames: string[]): Promise<string[]> {
    const fileName = 'package.json';

    const packageJsonExists = fileBrowser.fileNameExists(fileName);
    if (!packageJsonExists) {
        return [];
    }

    let filePaths = fileBrowser.getFilePathsForFileName(fileName);

    filePaths = await reducePromise(
        filePaths,
        async (filePaths: string[], filePath: string) => {
            const data = await fileBrowser.getFileData(filePath);
            const hasDependency = _.some(packageNames, (packageName) => _.has(data, ['dependencies', packageName]));
            const hasDevDependency = _.some(packageNames, (packageName) => _.has(data, ['devDependencies', packageName]));
            if (hasDependency || hasDevDependency) {
                filePaths.push(filePath);
            }
            return filePaths;
        },
        []
    );

    return _.map(filePaths, (filePath) => path.parse(filePath).dir);
}

export async function extractNodeEnvironmentVariablesFromFile(data: string): Promise<string[]> {
    const envVars: string[] = [];
    const envVarsRe = /process\.env\.(\w+)/g;
    let reResult;
    while ((reResult = envVarsRe.exec(data)) !== null) {
        envVars.push(reResult[1]!);
    }
    return _.uniq(envVars);
}

interface GatsbySourceFilesystemOptions {
    name: string;
    path: string;
    ignore?: string[];
}

export function getGatsbySourceFilesystemOptions(data: string): GatsbySourceFilesystemOptions[] {
    // Use https://astexplorer.net/ with "JavaScript" and "acorn" parser to generate ESTree
    const ast = (acorn.parse(data, { ecmaVersion: 2020 }) as unknown) as estree.Program;
    // find an object having the following format:
    // {
    //   resolve: 'gatsby-source-filesystem',
    //   options: {
    //     path: `${__dirname}/content`,
    //     name: 'pages'
    //   }
    // }
    const result: GatsbySourceFilesystemOptions[] = [];
    traverseESTree(
        ast,
        (node: estree.Node) => {
            if (!isObjectExpressionNode(node)) {
                return true;
            }
            const resolveProperty = findObjectProperty(node, 'resolve');
            if (!resolveProperty) {
                return true;
            }
            // we found an object with 'resolve' property, which is one of the plugins
            // from now on, return false to not continue traversing the current subtree

            const isGatsbySourceFileSystem = propertyValueEqual(resolveProperty, 'gatsby-source-filesystem');
            if (!isGatsbySourceFileSystem) {
                return false;
            }
            const optionsProperty = findObjectProperty(node, 'options');
            if (!optionsProperty || !isObjectExpressionNode(optionsProperty.value)) {
                return false;
            }
            const pathProperty = findObjectProperty(optionsProperty.value, 'path');
            const nameProperty = findObjectProperty(optionsProperty.value, 'name');
            if (!pathProperty || !nameProperty) {
                return false;
            }
            let pathValue = getNodeValue(pathProperty.value);
            const nameValue = getNodeValue(nameProperty.value);
            if (typeof pathValue !== 'string' || typeof nameValue !== 'string') {
                return false;
            }
            pathValue = pathValue.replace(/^\${__dirname}\//, '');
            const ignoreProperty = findObjectProperty(optionsProperty.value, 'ignore');
            const ignoreValue = ignoreProperty ? getNodeValue(ignoreProperty.value) : null;
            result.push({
                name: nameValue,
                path: pathValue,
                ...(isStringArray(ignoreValue) ? { ignore: ignoreValue } : {})
            });
        },
        {
            iteratePrimitives: false
        }
    );
    return result;
}

function findObjectProperty(node: estree.ObjectExpression, propertyName: string) {
    return _.find(node.properties, (property): property is estree.Property => {
        return isPropertyNode(property) && propertyNameEqual(property, propertyName);
    });
}

function propertyNameEqual(property: estree.Property, propertyName: string) {
    // check both identifier and literal properties
    // { propertyName: '...' } OR { 'propertyName': '...' }
    return (isIdentifierNode(property.key) && property.key.name === propertyName) || (isLiteralNode(property.key) && property.key.value === propertyName);
}

function propertyValueEqual(property: estree.Property, propertyValue: string) {
    // check both literal and template literals values
    // { propertyName: 'propertyValue' } OR { propertyName: `propertyValue` }
    if (isLiteralNode(property.value) && property.value.value === propertyValue) {
        return true;
    }
    if (isTemplateLiteralNode(property.value)) {
        const value = property.value;
        return (
            value.expressions.length === 0 &&
            value.quasis.length === 1 &&
            isTemplateElementNode(value.quasis[0]!) &&
            value.quasis[0]!.value.raw === propertyValue
        );
    }
    return false;
}

/**
 * This method doesn't serialize every possible ESTree node value. It only
 * serializes literals, template literals and array expressions needed to
 * extract simple hard-coded values.
 *
 * If this method cannot serialize a value, it returns undefined
 */
function getNodeValue(node: estree.Node): any {
    if (isLiteralNode(node)) {
        return node.value;
    } else if (isTemplateLiteralNode(node)) {
        const expressions = node.expressions;
        const quasis = node.quasis;
        const sortedNodes = _.sortBy([...expressions, ...quasis], 'start');
        return _.reduce(
            sortedNodes,
            (result: string | undefined, node) => {
                if (result === undefined) {
                    return result;
                }
                if (isTemplateElementNode(node)) {
                    return result + node.value.raw;
                } else if (isIdentifierNode(node)) {
                    return result + '${' + node.name + '}';
                }
                return undefined;
            },
            ''
        );
    } else if (isArrayExpressionNode(node)) {
        return _.reduce(
            node.elements,
            (result: any[] | undefined, node) => {
                if (result === undefined) {
                    return result;
                }
                if (node === null) {
                    return undefined;
                }
                const value = getNodeValue(node);
                if (value === undefined) {
                    return value;
                }
                result.push(value);
                return result;
            },
            []
        );
    }
    return undefined;
}

function isObjectExpressionNode(node: estree.Node): node is estree.ObjectExpression {
    return node.type === 'ObjectExpression';
}

function isArrayExpressionNode(node: estree.Node): node is estree.ArrayExpression {
    return node.type === 'ArrayExpression';
}

function isIdentifierNode(node: estree.Node): node is estree.Identifier {
    return node.type === 'Identifier';
}

function isLiteralNode(node: estree.Node): node is estree.Literal {
    return node.type === 'Literal';
}

function isPropertyNode(node: estree.Node): node is estree.Property {
    return node.type === 'Property';
}

function isTemplateLiteralNode(node: estree.Node): node is estree.TemplateLiteral {
    return node.type === 'TemplateLiteral';
}

function isTemplateElementNode(node: estree.Node): node is estree.TemplateElement {
    return node.type === 'TemplateElement';
}

function isStringArray(value: any): value is string[] {
    return _.isArray(value) && _.every(value, _.isString);
}

function traverseESTree(
    value: any,
    iteratee: (value: any, keyPath: (string | number)[], stack: any[]) => any,
    options: { iterateCollections?: boolean; iteratePrimitives?: boolean } = {}
) {
    const context = _.get(options, 'context');
    const iterateCollections = _.get(options, 'iterateCollections', true);
    const iteratePrimitives = _.get(options, 'iteratePrimitives', true);

    function _traverse(value: any, keyPath: (string | number)[], stack: any[]) {
        const isArrayOrObject = _.isPlainObject(value) || _.isArray(value) || value instanceof acorn.Node;
        const invokeIteratee = isArrayOrObject ? iterateCollections : iteratePrimitives;
        let continueTraversing = true;
        if (invokeIteratee) {
            continueTraversing = iteratee.call(context, value, keyPath, stack);
        }
        if (isArrayOrObject && continueTraversing) {
            _.forEach(value, (val: any, key: string | number) => {
                _traverse(val, _.concat(keyPath, key), _.concat(stack, [value]));
            });
        }
    }

    _traverse(value, [], []);
}

export function getGatsbySourceFilesystemOptionsUsingRegExp(data: string) {
    // {
    //   resolve: `gatsby-source-filesystem`,
    //   options: {
    //     name: 'pages',
    //     path: `${__dirname}/src/pages`
    //   }
    // }
    // eslint-disable-next-line
    const gatsbySourceFilesystemRegExp = /resolve\s*:\s*(['"`])gatsby-source-filesystem\1\s*,\s*options\s*:\s*{\s*(\w+)\s*:\s*(['"`])([^'"`]+)\3\s*,\s*(\w+)\s*:\s*(['"`])([^'"`]+)\6/g;
    let match: RegExpExecArray | null;
    const fileSystemOptions = [];
    while ((match = gatsbySourceFilesystemRegExp.exec(data)) !== null) {
        const option1 = match[2];
        const option2 = match[5];
        const value1 = match[4];
        const value2 = match[7];
        if (option1 === 'name' && option2 === 'path' && value1 && value2) {
            fileSystemOptions.push({
                name: value1,
                path: value2
            });
        } else if (option1 === 'path' && option2 === 'name' && value1 && value2) {
            fileSystemOptions.push({
                name: value2,
                path: value1
            });
        }
    }
    return fileSystemOptions;
}
