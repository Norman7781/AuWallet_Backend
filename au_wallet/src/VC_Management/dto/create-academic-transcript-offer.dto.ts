// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsInt,
//   IsNumber,
//   IsObject,
//   IsOptional,
//   IsString,
//   Min,
//   ValidateNested,
// } from 'class-validator';

// // ---------- documentContext ----------

// export class NameValueDto {
//   @IsString()
//   name!: string;

//   @IsString()
//   value!: string;
// }

// export class AuthorDto {
//   @IsString()
//   name!: string;
// }

// export class DocumentContextDto {
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => NameValueDto)
//   identifier?: NameValueDto[];

//   @IsOptional()
//   @IsString()
//   schemaVersion?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => AuthorDto)
//   author?: AuthorDto;
// }

// // ---------- documentInformation ----------

// export class PropertyIdValueDto {
//   @IsOptional()
//   @IsString()
//   propertyID?: string;

//   @IsOptional()
//   @IsString()
//   value?: string;
// }

// export class InLanguageDto {
//   @IsOptional()
//   @IsString()
//   name?: string;

//   @IsOptional()
//   @IsString()
//   alternateName?: string;
// }

// export class DocumentInformationDto {
//   @ValidateNested()
//   @Type(() => PropertyIdValueDto)
//   identifier!: PropertyIdValueDto;

//   @IsOptional()
//   @IsString()
//   name?: string;

//   @IsString()
//   additionalType!: string;

//   @IsOptional()
//   @IsString()
//   educationalUse?: string;

//   @IsString()
//   datePublished!: string;

//   @ValidateNested()
//   @Type(() => InLanguageDto)
//   inLanguage!: InLanguageDto;
// }

// // ---------- student ----------

// export class Identifier3Dto {
//   @IsOptional()
//   @IsString()
//   name?: string;

//   @IsOptional()
//   @IsString()
//   value?: string;
// }

// export class ResidentCountryOrTerritoryDto {
//   @IsOptional()
//   @IsString()
//   addressCountry?: string;
// }

// export class ProgramTypeItemDto {
//   @IsString()
//   termCode!: string;

//   @IsString()
//   name!: string;

//   @IsOptional()
//   @IsString()
//   additionalType?: string;
// }

// export class ProgramContextDto {
//   @IsOptional()
//   @ValidateNested()
//   @Type(() => Identifier3Dto)
//   identifier?: Identifier3Dto;

//   @IsOptional()
//   @IsString()
//   name?: string;

//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => ProgramTypeItemDto)
//   programType?: ProgramTypeItemDto[];

//   @IsOptional()
//   @IsString()
//   endDate?: string;
// }

// export class StudentDto {
//   @ValidateNested()
//   @Type(() => Identifier3Dto)
//   identifier!: Identifier3Dto;

//   @IsString()
//   honorificPrefix!: string;

//   @IsString()
//   givenName!: string;

//   @IsString()
//   familyName!: string;

//   @IsOptional()
//   @IsString()
//   gender?: string;

//   @IsOptional()
//   @IsString()
//   birthDate?: string;

//   @IsOptional()
//   @IsString()
//   nationality?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => ResidentCountryOrTerritoryDto)
//   residentCountryOrTerritory?: ResidentCountryOrTerritoryDto;

//   @IsOptional()
//   @IsString()
//   image?: string;

//   @IsOptional()
//   @IsString()
//   dateOfAdmission?: string;

//   @IsString()
//   facultyName!: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => ProgramContextDto)
//   programContext?: ProgramContextDto;
// }

// // ---------- educationalOrganization ----------

// export class AddressDto {
//   @IsString()
//   streetAddress!: string;

//   @IsString()
//   addressLocality!: string;

//   @IsString()
//   addressRegion!: string;

//   @IsString()
//   postalCode!: string;

//   @IsString()
//   addressCountry!: string;
// }

// export class SubOrganizationDto {
//   @ValidateNested()
//   @Type(() => Identifier3Dto)
//   identifier!: Identifier3Dto;

//   @IsString()
//   name!: string;

//   @ValidateNested()
//   @Type(() => AddressDto)
//   address!: AddressDto;
// }

// export class RegistrarDto {
//   @ValidateNested()
//   @Type(() => Identifier3Dto)
//   identifier!: Identifier3Dto;

//   @IsString()
//   jobTitle!: string;

//   @IsString()
//   honorificPrefix!: string;

//   @IsString()
//   name!: string;

//   @IsString()
//   email!: string;
// }

// export class EducationalOrganizationDto {
//   @IsOptional()
//   @ValidateNested()
//   @Type(() => Identifier3Dto)
//   identifier?: Identifier3Dto;

//   @IsString()
//   name!: string;

//   @IsOptional()
//   @IsString()
//   schoolLevel?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => AddressDto)
//   address?: AddressDto;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => SubOrganizationDto)
//   subOrganization?: SubOrganizationDto;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => RegistrarDto)
//   registrar?: RegistrarDto;
// }

// // ---------- courseList ----------

// export class CourseTransferItemDto {
//   @IsString()
//   courseCode!: string;

//   @ValidateNested()
//   @Type(() => AuthorDto)
//   provider!: AuthorDto;

//   @IsString()
//   name!: string;
// }

// export class AffiliationDto {
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => NameValueDto)
//   identifier?: NameValueDto[];

//   @IsOptional()
//   @IsString()
//   name?: string;
// }

// export class ProviderDto {
//   @IsString()
//   name!: string;

//   @IsOptional()
//   @IsString()
//   jobTitle?: string;

//   @ValidateNested()
//   @Type(() => AffiliationDto)
//   affiliation!: AffiliationDto;
// }

// export class OrgProviderDto {
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => NameValueDto)
//   identifier!: NameValueDto[];

//   @IsString()
//   name!: string;
// }

// export class UsageInfoItemDto {
//   @IsString()
//   about!: string;

//   @IsString()
//   text!: string;
// }

// export class HasCourseDto {
//   @IsOptional()
//   @IsString()
//   courseCode?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => ProviderDto)
//   provider?: ProviderDto;

//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => UsageInfoItemDto)
//   usageInfo?: UsageInfoItemDto[];
// }

// export class CourseItemDto {
//   @IsString()
//   courseCode!: string;

//   @IsString()
//   name!: string;

//   @IsOptional()
//   @IsString()
//   additionalType?: string;

//   @IsOptional()
//   @IsString()
//   description?: string;

//   @Type(() => Number)
//   @IsInt()
//   numberOfCredits!: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   creditEarned?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   grade?: number;

//   @IsString()
//   gradeText!: string;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   pointEarned?: number;

//   @IsOptional()
//   @IsString()
//   programType?: string;

//   @IsOptional()
//   @IsString()
//   termsPerYear?: string;

//   @IsOptional()
//   @IsString()
//   timeToComplete?: string;

//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => CourseTransferItemDto)
//   CourseTransfer?: CourseTransferItemDto[];

//   @IsOptional()
//   @IsString()
//   termDuration?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => OrgProviderDto)
//   provider?: OrgProviderDto;

//   @IsOptional()
//   @IsString()
//   CourseDescription?: string;

//   @IsOptional()
//   @IsString()
//   occupationalCategory?: string;

//   @IsOptional()
//   @IsString()
//   url?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => HasCourseDto)
//   hasCourse?: HasCourseDto;
// }

// export class CourseListDto {
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => CourseItemDto)
//   itemListElement?: CourseItemDto[];
// }

// // ---------- academicSummary ----------

// export class SemesterSummaryItemDto {
//   @IsOptional()
//   @IsString()
//   educationTypeSystem?: string;

//   @IsString()
//   semesterName!: string;

//   @IsOptional()
//   @IsString()
//   semesterStatus?: string;

//   @IsOptional()
//   @IsString()
//   year?: string;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterCreditValue?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterCreditEarned?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterCreditCalculated?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterPointEarned?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterGPA?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   semesterGPAX?: number;

//   @IsOptional()
//   @IsString()
//   remark?: string;
// }

// export class AcademicSummaryDto {
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => SemesterSummaryItemDto)
//   semesterSummary?: SemesterSummaryItemDto[];

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   totalCreditValue?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   totalCreditEarned?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   totalCreditCalculated?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   totalPointEarned?: number;

//   @IsOptional()
//   @Type(() => Number)
//   @IsInt()
//   totalGPAX?: number;

//   @IsOptional()
//   @IsString()
//   remark?: string;
// }

// // ---------- additionalInformation ----------

// export class InformationNoteDto {
//   @IsOptional()
//   @IsString()
//   about?: string;

//   @IsOptional()
//   @IsString()
//   text?: string;
// }

// export class AdditionalInformationItemDto {
//   @IsString()
//   hons!: string;

//   @IsString()
//   thesisTitle!: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => InformationNoteDto)
//   infomationNote?: InformationNoteDto;
// }

// // ---------- top-level DTO ----------

// export class CreateAcademicTranscriptOfferDto {
//   @ValidateNested()
//   @Type(() => DocumentContextDto)
//   documentContext!: DocumentContextDto;

//   @ValidateNested()
//   @Type(() => DocumentInformationDto)
//   documentInformation!: DocumentInformationDto;

//   @ValidateNested()
//   @Type(() => StudentDto)
//   student!: StudentDto;

//   @ValidateNested()
//   @Type(() => EducationalOrganizationDto)
//   educationalOrganization!: EducationalOrganizationDto;

//   @ValidateNested()
//   @Type(() => CourseListDto)
//   courseList!: CourseListDto;

//   @ValidateNested()
//   @Type(() => AcademicSummaryDto)
//   academicSummary!: AcademicSummaryDto;

//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => AdditionalInformationItemDto)
//   @IsOptional()
//   additionalInformation?: AdditionalInformationItemDto[];
// }
import { IsString } from 'class-validator';

// The frontend only sends the student number when the registrar hits
// "Create VC" — the full nested transcript is built server-side from the
// authoritative student record (see academic-transcript_builder.ts),
// not accepted from the client.
export class CreateAcademicTranscriptOfferDto {
  @IsString()
  studentNumber!: string;
}
