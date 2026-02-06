import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { CustomersService } from "./customers.service";
import {
  CreateCustomerDto,
  CustomerResponseDto,
  CustomersListResponseDto,
  UpdateCustomerDto,
} from "./customers.dto";
import { ApiCode } from "@/common/api-codes.enum";
import { ForbiddenException } from "@nestjs/common";

interface RequestWithMember extends ExpressRequest {
  user: { userId: string };
  organizationMember: { id: string; organizationId: string; customerRestricted: boolean; role: string };
  allowedCustomerIds: string[] | null;
}

@ApiTags("customers")
@Controller("organizations/:organizationId/customers")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private requireAdminOrOwner(member: { role: string }) {
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  @Get()
  @ApiOperation({ summary: "List customers for the organization (hierarchy)" })
  @ApiResponse({ status: 200, type: CustomersListResponseDto })
  async list(
    @Param("organizationId") organizationId: string,
    @Query("customerId") filterCustomerId: string | undefined,
    @Request() req: RequestWithMember,
  ): Promise<CustomersListResponseDto> {
    let effectiveAllowed = req.allowedCustomerIds;
    if (filterCustomerId) {
      const descendantIds = await this.customersService.getDescendantCustomerIds(
        [filterCustomerId],
        organizationId,
      );
      const filterSet = [filterCustomerId, ...descendantIds];
      effectiveAllowed =
        req.allowedCustomerIds === null
          ? filterSet
          : filterSet.filter((id) => req.allowedCustomerIds!.includes(id));
    }
    const customers = await this.customersService.list(
      organizationId,
      effectiveAllowed,
    );
    return { customers };
  }

  @Post()
  @ApiOperation({ summary: "Create a customer" })
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateCustomerDto,
    @Request() req: RequestWithMember,
  ): Promise<CustomerResponseDto> {
    this.requireAdminOrOwner(req.organizationMember);
    return this.customersService.create(
      organizationId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Get(":customerId")
  @ApiOperation({ summary: "Get customer by id" })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async get(
    @Param("organizationId") organizationId: string,
    @Param("customerId") customerId: string,
    @Request() req: RequestWithMember,
  ): Promise<CustomerResponseDto> {
    return this.customersService.getById(
      customerId,
      organizationId,
      req.allowedCustomerIds,
    );
  }

  @Patch(":customerId")
  @ApiOperation({ summary: "Update customer" })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async update(
    @Param("organizationId") organizationId: string,
    @Param("customerId") customerId: string,
    @Body() body: UpdateCustomerDto,
    @Request() req: RequestWithMember,
  ): Promise<CustomerResponseDto> {
    this.requireAdminOrOwner(req.organizationMember);
    return this.customersService.update(
      customerId,
      organizationId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Delete(":customerId")
  @ApiOperation({ summary: "Delete customer (fails if has children or vehicles)" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: "Has children or vehicles" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  async delete(
    @Param("organizationId") organizationId: string,
    @Param("customerId") customerId: string,
    @Request() req: RequestWithMember,
  ): Promise<void> {
    this.requireAdminOrOwner(req.organizationMember);
    await this.customersService.delete(
      customerId,
      organizationId,
      req.allowedCustomerIds,
    );
  }
}
