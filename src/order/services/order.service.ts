import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderEntity } from '../../database/entities/order.entity';
import { CreateOrderPayload } from '../type';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async getAll(): Promise<OrderEntity[]> {
    return this.orderRepo.find();
  }

  async findById(id: string): Promise<OrderEntity | null> {
    return this.orderRepo.findOne({ where: { id } });
  }

  async create(data: CreateOrderPayload, manager?: EntityManager): Promise<OrderEntity> {
    const repo = manager ? manager.getRepository(OrderEntity) : this.orderRepo;
    const order = repo.create({
      user_id: data.userId,
      cart_id: data.cartId,
      delivery: data.address as unknown as Record<string, unknown>,
      payment: null,
      comments: null,
      status: 'OPEN',
      total: data.total,
    });
    return repo.save(order);
  }

  async update(id: string, partial: Partial<OrderEntity>): Promise<OrderEntity | null> {
    await this.orderRepo.update({ id }, partial);
    return this.findById(id);
  }
}
