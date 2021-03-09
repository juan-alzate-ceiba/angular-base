import { Libro } from './libro';

export class Prestamo {
  fechaSolicitud: string;
  libro: Libro;
  fechaEntregaMaxima: string;
  nombreUsuario: string;

  constructor(fechaSolicitud: string, libro: Libro, fechaEntregaMaxima: string, nombreUsuario: string) {
    this.fechaSolicitud = fechaSolicitud;
    this.libro = libro;
    this.fechaEntregaMaxima = fechaEntregaMaxima;
    this.nombreUsuario = nombreUsuario;
  }
}
