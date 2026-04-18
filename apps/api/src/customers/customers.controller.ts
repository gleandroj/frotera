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
import { PermissionGuard } from "@/auth/guards/permission.guard";
import { Permission } from "@/auth/decorators/permission.decorator";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";
import { CustomersService } from "./customers.service";
import {
  CreateCustomerDto,
  CustomerResponseDto,
  CustomersListResponseDto,
  UpdateCustomerDto,
} from "./customers.dto";

interface RequestWithMember extends ExpressRequest {
  user: { userId: string; isSuperAdmin?: boolean };
  organizationMember: { id: string; organizationId: string; customerRestricted: boolean };
  allowedCustomerIds: string[] | null;
}

@ApiTags("customers")
@Controller("organizations/:organizationId/customers")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.VIEW)
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
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.CREATE)
  @ApiOperation({ summary: "Create a customer" })
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateCustomerDto,
    @Request() req: RequestWithMember,
  ): Promise<CustomerResponseDto> {
    return this.customersService.create(
      organizationId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Get(":customerId")
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.VIEW)
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
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.EDIT)
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
    return this.customersService.update(
      customerId,
      organizationId,
      body,
      req.allowedCustomerIds,
    );
  }

  @Delete(":customerId")
  @Permission(RoleModuleEnum.COMPANIES, RoleActionEnum.DELETE)
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
    await this.customersService.delete(
      customerId,
      organizationId,
      req.allowedCustomerIds,
      req.user.isSuperAdmin === true,
    );
  }
}
