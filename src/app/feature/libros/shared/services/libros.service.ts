import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpService } from 'src/app/core/services/http.service';
import { Injectable } from '@angular/core';
import { Libro } from '@shared/models/libro';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LibrosService {

  constructor(protected http: HttpService) { }

  public crear(libro: Libro): Observable<any> {

    return this.http.doPost<Libro, boolean>(`${environment.endpoint}/libros`, libro,
      this.http.optsName('crear libro'))
      .pipe(
        map(data => data)
      );
  }

  public obtenerLibro(isbn: string): Observable<Libro> {
    return this.http.doGet<Libro>(`${environment.endpoint}/libros/${isbn}`,
      this.http.optsName('Obtener libro'))
    .pipe(
      map(data => data)
    )
  }
}
