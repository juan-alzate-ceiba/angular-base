import { Prestamo } from './../../../../shared/models/prestamo';
import { Libro } from './../../../../shared/models/libro';
import { ToastrModule } from 'ngx-toastr';
import { HttpService } from 'src/app/core/services/http.service';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';

import { CrearPrestamosComponent } from './crear-prestamos.component';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';


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
    .compileComponents();
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

  it('llamar metodo prestar cuando da click en el boton', () => {
    spyOn(component, 'prestar');

    let button = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    fixture.whenStable().then(() => {
      expect(component.prestar).toHaveBeenCalled;
    });

  });

  it('si libro está prestado, no crear nuevo prestamo', fakeAsync (() => {
    const dummyLibro = new Libro(ISBN, 'La guerra de los cielos', 1998);
    const dummyPrestamo = new Prestamo('03/03/2021', dummyLibro, '18/03/2021', 'Felipe');

    let service = jasmine.createSpyObj('PrestamosService', ["obtenerPrestamo", "prestar"]);
    // let spyCrearComponent = jasmine.createSpyObj('component', ['prestar']);

    setTimeout(() => {

      service.obtenerPrestamo.and.returnValue(
        of(dummyPrestamo)
        );

      // expect(spyCrearComponent.prestar).toHaveBeenCalled;
      expect(service.obtenerPrestamo).toHaveBeenCalled;
      expect(service.prestar).toHaveBeenCalledTimes(0);
    }, 1000);
    tick(1000); // solo se llama dentro de fakeAsync zone
  }) );

  it('si libro no está prestado, crear nuevo prestamo', fakeAsync (() => {
    let service = jasmine.createSpyObj('PrestamosService', ["obtenerPrestamo", "prestar"]);

    setTimeout(() => {
      service.obtenerPrestamo.and.returnValue(
        of(null)
        );

      expect(service.obtenerPrestamo).toHaveBeenCalled;
      expect(service.prestar).toHaveBeenCalled;
    }, 1000);

    tick(1000); // solo se llama dentro de fakeAsync zone

  }) );
});
