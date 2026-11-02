import { repositoriosEnMemoria } from "../../src/adaptadores/memoria/repositorios";
import { probarContratoRepositorios } from "./repositorios.contrato";

probarContratoRepositorios("en memoria", async () => repositoriosEnMemoria());
