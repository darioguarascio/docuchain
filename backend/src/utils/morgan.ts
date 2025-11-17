import morgan from 'morgan';
import chalk from 'chalk';
import { Request, Response } from 'express';

interface MorganRequest extends Request {
  _startAt?: [number, number];
}

interface MorganResponse extends Response {
  _startAt?: [number, number];
}

morgan.token('user-agent', (req: Request) => chalk.gray(req.headers['user-agent']));
morgan.token('remote-addr', (req: Request) =>
  chalk.black.bgWhite(req.headers['cf-connecting-ip'] ?? req.ip)
);
morgan.token('status', (req: Request, res: Response) => {
  req;
  return res.statusCode < 300
    ? chalk.green(res.statusCode)
    : res.statusCode < 400
      ? chalk.yellow(res.statusCode)
      : res.statusCode < 500
        ? chalk.red(res.statusCode)
        : chalk.white.bgRed(res.statusCode);
});
morgan.token('response-time', (req: Request, res: Response): any => {
  const morganReq = req as MorganRequest;
  const morganRes = res as MorganResponse;

  if (!morganReq._startAt || !morganRes._startAt) {
    return;
  }

  const t = parseFloat(
    (
      (morganRes._startAt[0] - morganReq._startAt[0]) * 1e3 +
      (morganRes._startAt[1] - morganReq._startAt[1]) * 1e-6
    ).toFixed(3)
  );

  return t < 200 ? chalk.green(`${t}ms`) : t < 600 ? chalk.yellow(`${t}ms`) : chalk.red(`${t}ms`);
});

export default morgan(
  '[:date[iso]] (:status) :method :url - :response-time - :remote-addr | :user-agent | :referrer'
);

