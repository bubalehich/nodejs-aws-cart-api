import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { User } from '../models';

@Injectable()
export class UsersService {
  private readonly users: Record<string, User>;

  constructor() {
    this.users = {};
    const id = '00000000-0000-0000-0000-000000000001';
    this.users[id] = { id, name: 'bubalehich', password: 'TEST_PASSWORD' };
  }

  findOne(name: string): User {
    for (const id in this.users) {
      if (this.users[id].name === name) {
        return this.users[id];
      }
    }
    return;
  }

  createOne({ name, password }: User): User {
    const id = randomUUID();
    const newUser = { id, name, password };

    this.users[id] = newUser;

    return newUser;
  }
}
