import { createApp } from "./app";
import { openDatabase } from "./db";
import { Store } from "./store";

const port = Number(process.env.PORT ?? 4000);
const db = openDatabase();
const store = new Store(db);
const app = createApp(store);

app.listen(port, () => {
  console.log(`art saver api listening on http://localhost:${port}`);
});