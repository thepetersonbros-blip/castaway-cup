import { createGameServer } from './app';

const port = Number(process.env.PORT || 3001);
const server = createGameServer();
server.listen(port).then((p) => {
  console.log(`[castaway-cup] serving on http://localhost:${p}`);
});
