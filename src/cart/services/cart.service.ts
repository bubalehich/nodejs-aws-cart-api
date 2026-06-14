import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CartEntity, CartStatus } from '../../database/entities/cart.entity';
import { CartItemEntity } from '../../database/entities/cart-item.entity';
import { PutCartPayload } from 'src/order/type';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepo: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private readonly itemRepo: Repository<CartItemEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<CartEntity | null> {
    return this.cartRepo.findOne({
      where: { user_id: userId, status: CartStatus.OPEN },
      relations: { items: true },
    });
  }

  async createByUserId(userId: string): Promise<CartEntity> {
    const cart = this.cartRepo.create({ user_id: userId, status: CartStatus.OPEN, items: [] });
    return this.cartRepo.save(cart);
  }

  async findOrCreateByUserId(userId: string): Promise<CartEntity> {
    const existing = await this.findByUserId(userId);
    return existing ?? this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<CartEntity> {
    const cart = await this.findOrCreateByUserId(userId);
    const productId = payload.product.id;

    const existing = cart.items?.find((item) => item.product_id === productId);

    if (!existing) {
      if (payload.count > 0) {
        await this.itemRepo.save(
          this.itemRepo.create({ cart_id: cart.id, product_id: productId, count: payload.count }),
        );
      }
    } else if (payload.count === 0) {
      await this.itemRepo.delete({ cart_id: cart.id, product_id: productId });
    } else {
      existing.count = payload.count;
      await this.itemRepo.save(existing);
    }

    return this.cartRepo.findOne({ where: { id: cart.id }, relations: { items: true } }) as Promise<CartEntity>;
  }

  async removeByUserId(userId: string): Promise<void> {
    const cart = await this.findByUserId(userId);
    if (cart) {
      await this.cartRepo.delete({ id: cart.id });
    }
  }

  async markOrdered(cartId: string): Promise<void> {
    await this.cartRepo.update({ id: cartId }, { status: CartStatus.ORDERED });
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}
