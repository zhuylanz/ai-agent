import { z } from 'zod';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
 * Converts a JSONSchema7 definition to a Zod schema.
 * Supports the common schema structures used by MCP tools.
 */
export function convertJsonSchemaToZod(
  schema: JSONSchema7Definition,
): z.ZodTypeAny {
  if (typeof schema === 'boolean') {
    return schema ? z.any() : z.never();
  }

  return parseJsonSchema(schema);
}

function parseJsonSchema(schema: JSONSchema7): z.ZodTypeAny {
  // Handle nullable wrapper (e.g. { anyOf: [{ type: 'string' }, { type: 'null' }] })
  if (isNullable(schema)) {
    const nonNullSchema = getNonNullSubSchema(schema);
    if (nonNullSchema) {
      return parseJsonSchema(nonNullSchema).nullable();
    }
    return z.any().nullable();
  }

  // anyOf / oneOf → z.union
  if (schema.anyOf) {
    return parseUnion(schema.anyOf);
  }
  if (schema.oneOf) {
    return parseUnion(schema.oneOf);
  }

  // allOf → z.intersection
  if (schema.allOf) {
    return parseAllOf(schema.allOf);
  }

  // enum
  if (schema.enum !== undefined) {
    return parseEnum(schema.enum);
  }

  // const
  if (schema.const !== undefined) {
    return z.literal(schema.const as any);
  }

  // multiple types
  if (Array.isArray(schema.type)) {
    const schemas = schema.type.map((t) =>
      parsePrimitive({ ...schema, type: t as JSONSchema7['type'] }),
    );
    return schemas.length === 1
      ? schemas[0]
      : z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  switch (schema.type) {
    case 'object':
      return parseObject(schema);
    case 'array':
      return parseArray(schema);
    case 'string':
      return parseString(schema);
    case 'number':
    case 'integer':
      return parseNumber(schema);
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    default:
      // No type, but has properties → treat as object
      if (schema.properties) {
        return parseObject({ ...schema, type: 'object' });
      }
      return z.any();
  }
}

function parsePrimitive(schema: JSONSchema7): z.ZodTypeAny {
  switch (schema.type) {
    case 'string':
      return parseString(schema);
    case 'number':
    case 'integer':
      return parseNumber(schema);
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    case 'object':
      return parseObject(schema);
    case 'array':
      return parseArray(schema);
    default:
      return z.any();
  }
}

function parseObject(schema: JSONSchema7): z.ZodTypeAny {
  const properties = schema.properties;

  if (!properties || Object.keys(properties).length === 0) {
    const additionalProperties = schema.additionalProperties;
    if (additionalProperties === false) {
      return z.object({});
    }
    if (additionalProperties && typeof additionalProperties === 'object') {
      return z.record(parseJsonSchema(additionalProperties));
    }
    return z.record(z.any());
  }

  const required = new Set<string>(
    Array.isArray(schema.required) ? schema.required : [],
  );

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const zodProp = convertJsonSchemaToZod(propSchema);
    const hasDefault =
      typeof propSchema === 'object' && propSchema.default !== undefined;

    shape[key] = required.has(key) || hasDefault ? zodProp : zodProp.optional();
  }

  return z.object(shape);
}

function parseArray(schema: JSONSchema7): z.ZodTypeAny {
  if (!schema.items) {
    return z.array(z.any());
  }

  if (Array.isArray(schema.items)) {
    // Tuple type
    const itemSchemas = schema.items.map((item) =>
      convertJsonSchemaToZod(item),
    );
    return z.tuple(itemSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  return z.array(convertJsonSchemaToZod(schema.items));
}

function parseString(schema: JSONSchema7): z.ZodTypeAny {
  let zodSchema = z.string();

  if (schema.minLength !== undefined) {
    zodSchema = zodSchema.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    zodSchema = zodSchema.max(schema.maxLength);
  }
  if (schema.pattern !== undefined) {
    zodSchema = zodSchema.regex(new RegExp(schema.pattern));
  }

  return zodSchema;
}

function parseNumber(schema: JSONSchema7): z.ZodTypeAny {
  let zodSchema = schema.type === 'integer' ? z.number().int() : z.number();

  if (schema.minimum !== undefined) {
    zodSchema = zodSchema.min(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    zodSchema = zodSchema.max(schema.maximum);
  }
  if (schema.multipleOf !== undefined) {
    zodSchema = zodSchema.multipleOf(schema.multipleOf);
  }

  return zodSchema;
}

function parseUnion(schemas: JSONSchema7Definition[]): z.ZodTypeAny {
  const zodSchemas = schemas.map((s) => convertJsonSchemaToZod(s));

  if (zodSchemas.length === 0) return z.never();
  if (zodSchemas.length === 1) return zodSchemas[0];

  return z.union(zodSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function parseAllOf(schemas: JSONSchema7Definition[]): z.ZodTypeAny {
  const zodSchemas = schemas.map((s) => convertJsonSchemaToZod(s));

  if (zodSchemas.length === 0) return z.any();
  if (zodSchemas.length === 1) return zodSchemas[0];

  return zodSchemas.reduce((acc, cur) => z.intersection(acc, cur));
}

function parseEnum(values: JSONSchema7['enum']): z.ZodTypeAny {
  if (!values || values.length === 0) return z.never();
  if (values.length === 1) return z.literal(values[0] as any);

  const literals = values.map((v) => z.literal(v as any));
  return z.union(
    literals as [z.ZodLiteral<any>, z.ZodLiteral<any>, ...z.ZodLiteral<any>[]],
  );
}

function isNullable(schema: JSONSchema7): boolean {
  // Handle { nullable: true } (OpenAPI extension)
  if ((schema as any).nullable === true) return true;

  // Handle { anyOf: [..., { type: 'null' }] }
  if (schema.anyOf) {
    return (
      schema.anyOf.some((s) => typeof s === 'object' && s.type === 'null') &&
      schema.anyOf.length === 2
    );
  }

  return false;
}

function getNonNullSubSchema(schema: JSONSchema7): JSONSchema7 | undefined {
  if (schema.anyOf) {
    const nonNull = schema.anyOf.find(
      (s) => typeof s === 'object' && s.type !== 'null',
    );
    return typeof nonNull === 'object' ? nonNull : undefined;
  }
  return undefined;
}
