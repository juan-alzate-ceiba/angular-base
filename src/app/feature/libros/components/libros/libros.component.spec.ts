import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ToastrModule } from 'ngx-toastr';
import { Libro } from './../../../../shared/models/libro';
import { HttpService } from 'src/app/core/services/http.service';
import { LibrosService } from './../../shared/services/libros.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { ComponentFixture, fakeAsync, TestBed, flush } from '@angular/core/testing';

import { LibrosComponent } from './libros.component';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';

describe('LibrosComponent', () => {
  let component: LibrosComponent;
  let fixture: ComponentFixture<LibrosComponent>;
  let service: LibrosService;

  const ISBN = 'A874478A';
  const TITULO = 'Cien años de soledad';
  const ANIO = 1986;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LibrosComponent ],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientTestingModule,
        BrowserAnimationsModule,
        ToastrModule.forRoot()
      ],
      providers: [LibrosService, HttpService],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LibrosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    service = fixture.debugElement.injector.get(LibrosService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formulario vacio es invalido', () => {
    expect(component.libroForm.valid).toBeFalsy();
  });

  it('formulario con campos vacios es invalido', () => {
    component.libroForm.controls.isbn.setValue(ISBN);
    expect(component.libroForm.valid).toBeFalsy();
    component.libroForm.controls.isbn.setValue(ISBN);
    component.libroForm.controls.titulo.setValue(TITULO);
    expect(component.libroForm.valid).toBeFalsy();
    component.libroForm.controls.isbn.setValue('');
    component.libroForm.controls.titulo.setValue(TITULO);
    component.libroForm.controls.anio.setValue(ANIO);
    expect(component.libroForm.valid).toBeFalsy();
  });

  it('llamar metodo crear cuando da click en el boton', fakeAsync(() => {
    fixture.detectChanges();
    spyOn(component, 'crear');

    const button = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    flush();

    expect(component.crear).toHaveBeenCalledTimes(1);

  }) );

  it('no se debe crear libro si existe un libro con el mismo cod ISBN', fakeAsync(() => {
    const dummyLibro = new Libro(ISBN, TITULO, ANIO);

    // lleno el formulario para crear libro
    component.libroForm.controls.isbn.setValue(ISBN);
    component.libroForm.controls.titulo.setValue(TITULO);
    component.libroForm.controls.anio.setValue(ANIO);

    const compiled = fixture.debugElement.nativeElement;
    const anio = compiled.querySelector('input[id="anio"]');
    const fechaActual = new Date();

    // se crean espias para el servicio
    const spyObtenerLibro = spyOn(service, 'obtenerLibro').and.returnValue(of(dummyLibro));
    const spyCrear = spyOn(service, 'crear').and.returnValue(of(null));

    component.crear();
    expect(component.libroForm.valid).toBeTruthy();
    expect(anio.value).toBeLessThanOrEqual(fechaActual.getFullYear());
    expect(spyObtenerLibro).toHaveBeenCalledTimes(1);
    expect(spyCrear).toHaveBeenCalledTimes(0);
    flush();
  }) );

  it('debe crear libro si no existe un libro con el mismo cod ISBN', fakeAsync(() => {

    // lleno el formulario para crear libro
    component.libroForm.controls.isbn.setValue(ISBN);
    component.libroForm.controls.titulo.setValue(TITULO);
    component.libroForm.controls.anio.setValue(ANIO);

    const compiled = fixture.debugElement.nativeElement;
    const anio = compiled.querySelector('input[id="anio"]');

    expect(component.libroForm.valid).toBeTruthy();

    const fechaActual = new Date();

    // se crean espias para el servicio
    const spyObtenerLibro = spyOn(service, 'obtenerLibro').and.returnValue(of(null));
    const spyCrear = spyOn(service, 'crear').and.returnValue(of(null));

    component.crear();
    expect(anio.value).toBeLessThanOrEqual(fechaActual.getFullYear());
    expect(spyObtenerLibro).toHaveBeenCalledTimes(1);
    expect(spyCrear).toHaveBeenCalledTimes(1);
    flush();
  }) );

  it('si el año ingresado es mayor que el año actual mostrar mensaje de error', () => {
    // lleno el formulario para crear libro
    component.libroForm.controls.isbn.setValue(ISBN);
    component.libroForm.controls.titulo.setValue(TITULO);
    component.libroForm.controls.anio.setValue(2022);

    const compiled = fixture.debugElement.nativeElement;
    const anio = compiled.querySelector('input[id="anio"]');

    expect(component.libroForm.valid).toBeTruthy();

    const fechaActual = new Date();

    component.crear();

    expect(anio.value).toBeGreaterThan(fechaActual.getFullYear());
    expect(component.submitted).toBe(false);
  });

});
