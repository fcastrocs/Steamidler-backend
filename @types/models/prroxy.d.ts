// model proxy
interface Proxy {
  _id?: ObjectId;
  name: string;
  ip: string;
  port: number;
  load: number;
}
