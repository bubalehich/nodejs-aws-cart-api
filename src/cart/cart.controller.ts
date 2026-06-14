import {
  Controller,
  Get,
  Delete,
  Put,
  Body,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { BasicAuthGuard } from '../auth';
import { OrderService } from '../order';
import { AppRequest, getUserIdFromRequest } from '../shared';
import { CartService } from './services';
import { CreateOrderDto, PutCartPayload } from 'src/order/type';
import { CartEntity } from '../database/entities/cart.entity';
import { OrderEntity } from '../database/entities/order.entity';

@Controller('api/profile/cart')
export class CartController {
  constructor(
    private cartService: CartService,
    private orderService: OrderService,
  ) {}

  private shape(items: { product_id: string; count: number }[] | undefined) {
    return (items ?? []).map((item) => ({
      product: { id: item.product_id },
      count: item.count,
    }));
  }

  @UseGuards(BasicAuthGuard)
  @Get()
  async findUserCart(@Req() req: AppRequest) {
    const cart = await this.cartService.findOrCreateByUserId(getUserIdFromRequest(req));
    return this.shape(cart.items);
  }

  @UseGuards(BasicAuthGuard)
  @Put()
  async updateUserCart(@Req() req: AppRequest, @Body() body: PutCartPayload) {
    const cart = await this.cartService.updateByUserId(getUserIdFromRequest(req), body);
    return this.shape(cart.items);
  }

  @UseGuards(BasicAuthGuard)
  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearUserCart(@Req() req: AppRequest) {
    await this.cartService.removeByUserId(getUserIdFromRequest(req));
  }

  @UseGuards(BasicAuthGuard)
  @Put('order')
  async checkout(@Req() req: AppRequest, @Body() body: CreateOrderDto) {
    const userId = getUserIdFromRequest(req);
    const cart = await this.cartService.findByUserId(userId);

    if (!cart || !cart.items?.length) {
      throw new BadRequestException('Cart is empty');
    }

    const total = cart.items.reduce((sum, item) => sum + item.count, 0);

    const order = await this.cartService.getDataSource().transaction(async (manager) => {
      const created = await this.orderService.create(
        {
          userId,
          cartId: cart.id,
          items: cart.items.map((item) => ({ productId: item.product_id, count: item.count })),
          address: body.address,
          total,
        },
        manager,
      );
      await manager.getRepository(CartEntity).update({ id: cart.id }, { status: 'ORDERED' as any });
      return created;
    });

    return { order };
  }

  @UseGuards(BasicAuthGuard)
  @Get('order')
  async getOrder(): Promise<OrderEntity[]> {
    return this.orderService.getAll();
  }
}
