import { config } from '../config';
import type { EventBus } from './bus';
import { KafkaEventBus } from './kafkaBus';
import { MemoryEventBus } from './memoryBus';
import { RedisStreamEventBus } from './redisBus';

let bus: EventBus | null = null;

export function getBus(): EventBus {
  if (!bus) bus = createBus(config.EVENT_BUS);
  return bus;
}

export function setBus(b: EventBus) {
  bus = b;
}

export function createBus(kind: EventBus['kind']): EventBus {
  switch (kind) {
    case 'kafka':
      return new KafkaEventBus();
    case 'redis':
      return new RedisStreamEventBus();
    default:
      return new MemoryEventBus();
  }
}

export * from './bus';
