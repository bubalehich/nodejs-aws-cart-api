import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderModule } from '../order/order.module';
import { CartEntity } from '../database/entities/cart.entity';
import { CartItemEntity } from '../database/entities/cart-item.entity';
import { CartController } from './cart.controller';
import { CartService } from './services';

@Module({
  imports: [TypeOrmModule.forFeature([CartEntity, CartItemEntity]), OrderModule],
  providers: [CartService],
  controllers: [CartController],
})
export class CartModule {}
