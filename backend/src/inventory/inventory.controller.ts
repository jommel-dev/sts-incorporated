import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { PaginatedQueryDto } from './dto/paginated-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

type AuthReq = { user?: Record<string, unknown> };
const orgId = (req: AuthReq) => Number(req.user?.['orgId'] ?? 0);
const userId = (req: AuthReq) => Number(req.user?.['sub'] ?? 0);

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('search')
  search(@Query('q') q: string, @Req() req: AuthReq) {
    return this.svc.search(q ?? '', orgId(req));
  }

  @Get('low-stock')
  getLowStock(@Req() req: AuthReq) {
    return this.svc.getLowStock(orgId(req));
  }

  @Get('suppliers/search')
  searchSuppliers(@Query('q') q: string, @Req() req: AuthReq) {
    return this.svc.searchSuppliers(orgId(req), q ?? '');
  }

  @Get('suppliers')
  getSuppliers(@Req() req: AuthReq) {
    return this.svc.getSuppliers(orgId(req));
  }

  @Post('suppliers')
  createSupplier(@Body() body: { name: string; contactInfo?: string; email?: string; address?: string }, @Req() req: AuthReq) {
    return this.svc.createSupplier(orgId(req), body);
  }

  @Get('brands')
  getBrands(@Query('q') q: string, @Req() req: AuthReq) {
    return this.svc.getBrands(orgId(req), q);
  }

  @Post('brands')
  createBrand(@Body() body: { name: string }, @Req() req: AuthReq) {
    return this.svc.createBrand(orgId(req), body.name);
  }

  @Get('categories')
  getCategories(@Query('q') q: string, @Req() req: AuthReq) {
    return this.svc.getCategories(orgId(req), q);
  }

  @Post('categories')
  createCategory(@Body() body: { name: string }, @Req() req: AuthReq) {
    return this.svc.createCategory(orgId(req), body.name);
  }

  @Get('purchase-orders')
  findAllPO(@Query('status') status: string, @Req() req: AuthReq) {
    return this.svc.findAllPO(orgId(req), status);
  }

  @Get('purchase-orders/:id')
  findOnePO(@Param('id') id: string, @Req() req: AuthReq) {
    return this.svc.findOnePO(+id, orgId(req));
  }

  @Post('purchase-orders')
  createPO(@Body() body: CreatePurchaseOrderDto, @Req() req: AuthReq) {
    return this.svc.createPO(orgId(req), userId(req), body);
  }

  @Patch('purchase-orders/:id/status')
  updatePOStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: AuthReq) {
    return this.svc.updatePOStatus(+id, orgId(req), body.status);
  }

  @Patch('purchase-orders/:id')
  updatePO(@Param('id') id: string, @Body() body: any, @Req() req: AuthReq) {
    return this.svc.updatePO(+id, orgId(req), body);
  }

  @Post('purchase-orders/:id/receive')
  receivePO(@Param('id') id: string, @Req() req: AuthReq) {
    return this.svc.receivePO(+id, orgId(req));
  }

  @Get('download')
  async download(@Query() query: PaginatedQueryDto, @Req() req: AuthReq, @Res() res: any) {
    const result = await this.svc.downloadInventoryCSV(orgId(req), query);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="inventory.csv"',
    });
    res.send(result.csv);
  }

  @Get()
  findAll(@Query() query: PaginatedQueryDto, @Req() req: AuthReq) {
    return this.svc.findAll(orgId(req), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthReq) {
    return this.svc.findOne(+id, orgId(req));
  }

  @Post()
  create(@Body() body: CreateProductDto, @Req() req: AuthReq) {
    return this.svc.create(orgId(req), body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: AuthReq) {
    return this.svc.update(+id, orgId(req), body);
  }

  @Post(':id/adjust-stock')
  adjustStock(@Param('id') id: string, @Body() body: { qty: number; notes?: string }, @Req() req: AuthReq) {
    return this.svc.adjustStock(+id, orgId(req), body.qty, body.notes);
  }
}
