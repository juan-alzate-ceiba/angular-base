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

  const apiEndpointCrearLibro = `${environment.endpoint}/libros`

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

  it('deberia crear un libro', () => {
    const dummyLibro = new Libro('A65478Q', 'La guerra de los cielos', 1998);
    service.crear(dummyLibro).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointCrearLibro);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });
});
