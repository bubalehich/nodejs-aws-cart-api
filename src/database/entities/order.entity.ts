import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cart_id: string;

  @Column({ type: 'jsonb', nullable: true })
  payment: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  delivery: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'varchar', length: 32, default: 'OPEN' })
  status: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: number;
}
