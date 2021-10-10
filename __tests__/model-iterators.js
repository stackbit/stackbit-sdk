const { iterateModelFieldsRecursively } = require('../src/utils');

test('iterateModelFieldsRecursively should iterate all model fields recursively', () => {
    const model = {
        type: 'object',
        name: 'model',
        label: 'Model',
        fields: [
            { type: 'string', name: 'string_field' },
            { type: 'model', name: 'model_field', models: ['model_1', 'model_2'] },
            { type: 'list', name: 'list_string_field' },
            { type: 'list', name: 'list_model_field', items: { type: 'model', models: ['model_1', 'model_2'] } },
            {
                type: 'object',
                name: 'object_field',
                fields: [
                    { type: 'string', name: 'object_string_field' },
                    { type: 'object', name: 'object_object_field', fields: [{ type: 'string', name: 'object_object_string_field' }] },
                    { type: 'list', name: 'object_list_string_field', items: { type: 'string' } },
                    {
                        type: 'list',
                        name: 'object_list_object_field',
                        items: { type: 'object', fields: [{ type: 'string', name: 'object_list_object_string_field' }] }
                    }
                ]
            },
            {
                type: 'list',
                name: 'list_object_field',
                items: {
                    type: 'object',
                    fields: [
                        { type: 'string', name: 'list_object_string_field' },
                        { type: 'object', name: 'list_object_object_field', fields: [{ type: 'string', name: 'list_object_object_string_field' }] },
                        {
                            type: 'list',
                            name: 'list_object_list_object_field',
                            items: { type: 'object', fields: [{ type: 'string', name: 'list_object_list_object_string_field' }] }
                        },
                        { type: 'list', name: 'list_object_list_string_field', items: { type: 'string' } }
                    ]
                }
            }
        ]
    };
    const expectedCalls = [
        { fieldPath: ['fields', 'string_field'], field: model.fields[0] },
        { fieldPath: ['fields', 'model_field'], field: model.fields[1] },
        { fieldPath: ['fields', 'list_string_field'], field: model.fields[2] },
        { fieldPath: ['fields', 'list_model_field'], field: model.fields[3] },
        { fieldPath: ['fields', 'object_field'], field: model.fields[4] },
        { fieldPath: ['fields', 'object_field', 'fields', 'object_string_field'], field: model.fields[4].fields[0] },
        { fieldPath: ['fields', 'object_field', 'fields', 'object_object_field'], field: model.fields[4].fields[1] },
        {
            fieldPath: ['fields', 'object_field', 'fields', 'object_object_field', 'fields', 'object_object_string_field'],
            field: model.fields[4].fields[1].fields[0]
        },
        { fieldPath: ['fields', 'object_field', 'fields', 'object_list_string_field'], field: model.fields[4].fields[2] },
        { fieldPath: ['fields', 'object_field', 'fields', 'object_list_object_field'], field: model.fields[4].fields[3] },
        {
            fieldPath: ['fields', 'object_field', 'fields', 'object_list_object_field', 'items', 'fields', 'object_list_object_string_field'],
            field: model.fields[4].fields[3].items.fields[0]
        },
        { fieldPath: ['fields', 'list_object_field'], field: model.fields[5] },
        { fieldPath: ['fields', 'list_object_field', 'items', 'fields', 'list_object_string_field'], field: model.fields[5].items.fields[0] },
        { fieldPath: ['fields', 'list_object_field', 'items', 'fields', 'list_object_object_field'], field: model.fields[5].items.fields[1] },
        {
            fieldPath: ['fields', 'list_object_field', 'items', 'fields', 'list_object_object_field', 'fields', 'list_object_object_string_field'],
            field: model.fields[5].items.fields[1].fields[0]
        },
        { fieldPath: ['fields', 'list_object_field', 'items', 'fields', 'list_object_list_object_field'], field: model.fields[5].items.fields[2] },
        {
            fieldPath: [
                'fields',
                'list_object_field',
                'items',
                'fields',
                'list_object_list_object_field',
                'items',
                'fields',
                'list_object_list_object_string_field'
            ],
            field: model.fields[5].items.fields[2].items.fields[0]
        },
        { fieldPath: ['fields', 'list_object_field', 'items', 'fields', 'list_object_list_string_field'], field: model.fields[5].items.fields[3] }
    ];

    const mockCallback = jest.fn();
    iterateModelFieldsRecursively(model, mockCallback);
    expect(mockCallback).toHaveBeenCalledTimes(18);
    expectedCalls.forEach((expectedCall, index) => {
        expect(mockCallback.mock.calls[index][0]).toMatchObject(expectedCall.field);
        expect(mockCallback.mock.calls[index][1]).toMatchObject(expectedCall.fieldPath);
    });
});
