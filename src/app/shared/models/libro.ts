export class Libro {
  isbn: string;
  titulo: string;
  anio: number;

  constructor(isbn: string, titulo: string, anio: number) {
    this.isbn = isbn;
    this.titulo = titulo;
    this.anio = anio;
  }
}
