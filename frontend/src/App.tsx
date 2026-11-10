import { Verificar } from "./pantallas/Verificar";

export function App() {
  return (
    <>
      <header className="cabecera">
        <h1>MatriculAR</h1>
        <p>
          ¿La categoría del gasista es compatible con tu trabajo? Te lo decimos con evidencia
          fechada del padrón de la distribuidora.
        </p>
      </header>
      <main>
        <Verificar />
      </main>
      <footer className="pie">
        <p>
          Proyecto final de la Tecnicatura Universitaria en Programación (UTN). MatriculAR no es una
          fuente oficial: muestra lo que publica cada distribuidora, con su fecha.
        </p>
      </footer>
    </>
  );
}
