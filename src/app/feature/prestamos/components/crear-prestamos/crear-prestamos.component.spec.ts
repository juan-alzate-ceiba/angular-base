import { Prestamo } from './../../../../shared/models/prestamo';
import { Libro } from './../../../../shared/models/libro';
import { ToastrModule } from 'ngx-toastr';
import { HttpService } from 'src/app/core/services/http.service';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';

import { CrearPrestamosComponent } from './crear-prestamos.component';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';


describe('CrearPrestamosComponent', () => {
  let component: CrearPrestamosComponent;
  let fixture: ComponentFixture<CrearPrestamosComponent>;

  const ISBN = 'A874478A';
  const NOMBRE_PRESTADORR = 'Felipe Alzate'

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CrearPrestamosComponent ],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientModule,
        ToastrModule.forRoot()
      ],
      providers: [PrestamosService, HttpService]
    })
    .compileComponents()
    .then(() => {
      fixture = TestBed.createComponent(CrearPrestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CrearPrestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formulario vacio es invalido', () => {
    expect(component.prestamoForm.valid).toBeFalsy();
  });

  it('formulario con campos vacio es invalido', () => {
    component.prestamoForm.controls.isbn.setValue(ISBN);
    expect(component.prestamoForm.valid).toBeFalsy();
    component.prestamoForm.controls.isbn.setValue('');
    component.prestamoForm.controls.nombre.setValue(NOMBRE_PRESTADORR);
    expect(component.prestamoForm.valid).toBeFalsy();
  });

  it('llamar metodo prestar cuando da click en el boton', fakeAsync(() => {
    // let comp = jasmine.createSpyObj('component', ['prestar']);
    spyOn(component, 'prestar');

    let button = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    flush();

    expect(component.prestar).toHaveBeenCalled;

  }) );

  it('si libro está prestado, no crear nuevo prestamo', (done) => {
    const dummyLibro = new Libro(ISBN, 'La guerra de los cielos', 1998);
    const dummyPrestamo = new Prestamo('03/03/2021', dummyLibro, '18/03/2021', 'Felipe');

    let service = jasmine.createSpyObj('PrestamosService', ["obtenerPrestamo", "prestar"]);

    setTimeout(() => {

      service.obtenerPrestamo.and.returnValue(
        of(dummyPrestamo)
        );

      expect(service.obtenerPrestamo).toHaveBeenCalledTimes(1);
      expect(service.prestar).toHaveBeenCalledTimes(0);
    }, 1000);
    done();
  } );

  it('si libro no está prestado, crear nuevo prestamo', (done) => {
    let service = jasmine.createSpyObj('PrestamosService', ["obtenerPrestamo", "prestar"]);

    setTimeout(() => {
      service.obtenerPrestamo.and.returnValue(
        of(null)
        );

        expect(service.obtenerPrestamo).toHaveBeenCalledTimes(1);
        expect(service.prestar).toHaveBeenCalledTimes(1);
      }, 1000);
      done();
  });

  it('debería retornar error si se quiere prestar un libro que está prestado', () =>{

    const prestamosService = fixture.debugElement.injector.get(PrestamosService);
    spyOn(prestamosService, 'obtenerPrestamo')
    .and.returnValue(throwError({status: 404}));

    expect(prestamosService.obtenerPrestamo).toBeTruthy();

  })
});
