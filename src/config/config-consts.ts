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
