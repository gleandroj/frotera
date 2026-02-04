import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { ApiCode } from "./api-codes.enum";

interface CodedHttpException extends HttpException {
  errorCode?: ApiCode;
  data?: Record<string, any>;
}

function isSnackCaseCode(str: string): boolean {
  // Checks for uppercase letters, underscores, and at least one letter
  return typeof str === "string" && /^[A-Z0-9_]+$/.test(str);
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: CodedHttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    // Get the exception response
    const exceptionResponse = exception.getResponse();
    let message: string;
    let errorCode: string;
    let data: Record<string, any> = {};

    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || exception.message;
      errorCode = responseObj.errorCode || this.getDefaultErrorCode(status);
      data = responseObj.data || {};
    } else {
      message = exception.message;
      errorCode = this.getDefaultErrorCode(status);
    }

    // If the message itself is a snack case code, treat it as errorCode
    if (isSnackCaseCode(message)) {
      errorCode = message;
      message = ""; // Optionally, you can set a default message or leave it empty
    }

    // Send response with error code for frontend translation
    const errorResponse = {
      statusCode: status,
      message, // Keep original message as fallback
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(Object.keys(data).length > 0 && { data }),
    };

    response.status(status).json(errorResponse);
  }

  private getDefaultErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiCode.COMMON_BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ApiCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiCode.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiCode.COMMON_NOT_FOUND;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ApiCode.COMMON_INTERNAL_SERVER_ERROR;
      default:
        return ApiCode.COMMON_INTERNAL_SERVER_ERROR;
    }
  }
}
