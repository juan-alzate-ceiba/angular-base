import { Prestamo } from './../../../../shared/models/prestamo';
import { TestBed } from '@angular/core/testing';

import { PrestamosService } from './prestamos.service';
import { environment } from 'src/environments/environment';
import { HttpService } from 'src/app/core/services/http.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpResponse } from '@angular/common/http';
import { Libro } from '@shared/models/libro';

describe('PrestamosService', () => {
  let httpMock: HttpTestingController;
  let service: PrestamosService;

  const ISBN = 'A874478A';
  const NOMBRE_PRESTADOR = 'Felipe Alzate';
  const apiEndpointPrestar = `${environment.endpoint}/prestamos`;

  beforeEach(() => {
    const injector = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PrestamosService, HttpService]
    });
    httpMock = injector.inject(HttpTestingController);
    service = TestBed.inject(PrestamosService);

  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deberia crear un prestamo', (done) => {
    service.prestar(ISBN, NOMBRE_PRESTADOR).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
      done();
    });
    const req = httpMock.expectOne(`${apiEndpointPrestar}/${ISBN}/${NOMBRE_PRESTADOR}`);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });

  it('deberia obtener prestamo', (done) => {
    const dummyLibro = new Libro('A65478Q', 'La guerra de los cielos', 1998);
    const dummyPrestamo = new Prestamo('03/03/2021', dummyLibro, '18/03/2021', 'Felipe');
    service.obtenerPrestamo(ISBN).subscribe((respuesta) => {
      expect(respuesta).toEqual(dummyPrestamo);
      done();
    });
    const req = httpMock.expectOne(`${apiEndpointPrestar}/${ISBN}`);
    expect(req.request.method).toBe('GET');
    req.flush(dummyPrestamo);
  });

});
