import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import academicTranscriptSchema from './academic-transcript.schema.json';
import { AcademicTranscriptClaims } from './Academic_tran_type';

// Requires tsconfig.json to have "resolveJsonModule": true (and
// "esModuleInterop": true) so the schema file above can be imported
// directly. Also requires the "ajv" package: npm install ajv

const SCHEMA_ID = 'https://au.ac.th/schemas/academic-transcript.schema.json';

const ajv = new Ajv({
  allErrors: true,
  // The schema wasn't authored with ajv's strict mode in mind (no
  // "additionalProperties", no "type" on every def) — relax strict mode
  // rather than editing the schema to satisfy ajv's stricter defaults.
  strict: false,
  // The schema declares "$schema": "https://json-schema.org/draft-07/schema#"
  // (https), but ajv's bundled draft-07 meta-schema is registered under the
  // http:// URL. That mismatch makes ajv throw "no schema with key or ref"
  // on addSchema() before it ever validates any data. We don't need ajv to
  // meta-validate the schema itself (only to use it to validate claims),
  // so this is disabled rather than editing the schema file.
  validateSchema: false,
});

ajv.addSchema(academicTranscriptSchema as object, SCHEMA_ID);

const validateCredentialSubject: ValidateFunction | undefined = ajv.getSchema(
  `${SCHEMA_ID}#/definitions/credentialSubject_type`,
);

if (!validateCredentialSubject) {
  throw new Error(
    'credentialSubject_type definition not found in academic-transcript.schema.json — ' +
      'check the schema file was copied in without modification.',
  );
}

export class SchemaValidationError extends Error {
  constructor(public readonly errors: ErrorObject[] | null | undefined) {
    super('Academic transcript claims do not match the schema');
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validates a built AcademicTranscriptClaims object against
 * #/definitions/credentialSubject_type in academic-transcript.schema.json
 * — the same schema you originally supplied. Throws SchemaValidationError
 * (with the full ajv error list) if the object doesn't conform.
 */
export function validateAcademicTranscriptClaims(
  claims: AcademicTranscriptClaims,
): void {
  const valid = validateCredentialSubject!(claims);
  if (!valid) {
    throw new SchemaValidationError(validateCredentialSubject!.errors);
  }
}
