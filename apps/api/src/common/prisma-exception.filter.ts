import {
  ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception.code === 'P2002') {
      const conflict = new ConflictException('A record with these values already exists');
      return response.status(conflict.getStatus()).json(conflict.getResponse());
    }

    if (exception.code === 'P2025') {
      const notFound = new NotFoundException('The requested record was not found');
      return response.status(notFound.getStatus()).json(notFound.getResponse());
    }

    this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
    const failure = new InternalServerErrorException('A database operation failed');
    return response.status(failure.getStatus()).json(failure.getResponse());
  }
}
