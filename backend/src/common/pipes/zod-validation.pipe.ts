import { HttpException, HttpStatus, Injectable, PipeTransform } from "@nestjs/common";
import { z } from "zod";

import { ApiFieldIssue, ERROR_CODE } from "../errors/api-error.response";

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: z.ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    const issues: ApiFieldIssue[] = result.error.issues.map((issue) => ({
      code: issue.code,
      field: issue.path.map(String).join(".") || "$",
      message: issue.message,
    }));

    throw new HttpException(
      {
        code: ERROR_CODE.VALIDATION_ERROR,
        issues,
        message: "Request validation failed.",
        ok: false,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
