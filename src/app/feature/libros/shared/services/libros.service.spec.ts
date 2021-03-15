import { environment } from 'src/environments/environment';
import { HttpService } from 'src/app/core/services/http.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LibrosService } from './libros.service';
import { Libro } from '@shared/models/libro';
import { HttpResponse } from '@angular/common/http';

describe('LibrosService', () => {
  let httpMock: HttpTestingController;
  let service: LibrosService;

  const ISBN = 'A874478A';
  const NOMBRE = 'La guerra de los cielos';
  const ANIO = 1998;
  const apiEndpointCrearLibro = `${environment.endpoint}/libros`;
  const apiEndpointObtenerLibro = `${environment.endpoint}/libros`;

  beforeEach(() => {
    const injector = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LibrosService, HttpService]
    });
    httpMock = injector.inject(HttpTestingController);
    service = TestBed.inject(LibrosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deberia crear un libro', (done) => {
    const dummyLibro = new Libro(ISBN, NOMBRE, ANIO);
    service.crear(dummyLibro).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
      done();
    });
    const req = httpMock.expectOne(apiEndpointCrearLibro);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });

  it('comprobar si un libro está creado', (done) => {
    const dummyLibro = new Libro(ISBN, NOMBRE, ANIO);
    service.obtenerLibro(ISBN).subscribe((respuesta) => {
      expect(respuesta).toEqual(dummyLibro);
      done();
    });
    const req = httpMock.expectOne(`${apiEndpointObtenerLibro}/${ISBN}`);
    expect(req.request.method).toBe('GET');
    req.flush(dummyLibro);
  });
});
