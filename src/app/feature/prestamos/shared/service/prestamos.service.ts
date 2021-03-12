import { Observable } from 'rxjs';
import { Prestamo } from './../../../../shared/models/prestamo';
import { Injectable } from '@angular/core';
import { HttpService } from '@core/services/http.service';
import { environment } from 'src/environments/environment';
import { map } from 'rxjs/operators';

@Injectable()
export class PrestamosService {

  constructor(protected http: HttpService) { }

  public prestar(isbn: string, nombre: string): Observable<any> {
    return this.http.doPost<Prestamo, boolean>(`${environment.endpoint}/prestamos/${isbn}/${nombre}`, null,
    this.http.optsName('prestamos'))
    .pipe (
      map( data => data)
    );
  }

  public obtenerPrestamo(isbn: string): Observable<Prestamo> {
    return this.http.doGet<Prestamo>(`${environment.endpoint}/prestamos/${isbn}`,
    this.http.optsName('consultar prestamos'))
    .pipe (
      map(data => data)
    );
  }
}
