// SSGs Stackbit Studio supports
export const SSG_NAMES = ['unibit', 'jekyll', 'hugo', 'gatsby', 'nextjs', 'custom', 'eleventy', 'vuepress', 'gridsome', 'nuxt', 'sapper', 'hexo'] as const;

// CMSes Stackbit Studio supports
export const CMS_NAMES = ['git', 'contentful', 'sanity', 'forestry', 'netlifycms'] as const;

export const FIELD_TYPES = [
    'string',
    'url',
    'slug',
    'text',
    'markdown',
    'html',
    'number',
    'boolean',
    'enum',
    'date',
    'datetime',
    'color',
    'image',
    'file',
    'object',
    'model',
    'reference',
    'style',
    'list'
] as const;

export const STYLE_PROPS = [
    'objectFit',
    'objectPosition',
    'flexDirection',
    'justifyContent',
    'justifyItems',
    'justifySelf',
    'alignContent',
    'alignItems',
    'alignSelf',
    'padding',
    'margin',
    'width',
    'height',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'textAlign',
    'textColor',
    'textDecoration',
    'backgroundColor',
    'backgroundPosition',
    'backgroundSize',
    'borderRadius',
    'borderWidth',
    'borderColor',
    'borderStyle',
    'boxShadow',
    'opacity'
] as const;

export const STYLE_PROPS_VALUES = {
    nineRegions: ['top', 'center', 'bottom', 'left', 'left-top', 'left-bottom', 'right', 'right-top', 'right-bottom'],
    objectFit: ['none', 'contain', 'cover', 'fill', 'scale-down'],
    flexDirection: ['row', 'row-reverse', 'col', 'col-reverse'],
    justifyContent: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    justifyItems: ['start', 'end', 'center', 'stretch'],
    justifySelf: ['auto', 'start', 'end', 'center', 'stretch'],
    alignContent: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch'],
    alignItems: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
    alignSelf: ['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
    width: ['auto', 'narrow', 'wide', 'full'],
    height: ['auto', 'full', 'screen'],
    fontSize: ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large'],
    fontStyle: ['normal', 'italic'],
    fontWeight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    textAlign: ['left', 'center', 'right', 'justify'],
    textDecoration: ['none', 'underline', 'line-through'],
    backgroundSize: ['auto', 'cover', 'contain'],
    borderRadius: ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'full'],
    borderStyle: ['solid', 'dashed', 'dotted', 'double', 'none'],
    boxShadow: ['none', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'inner']
};
