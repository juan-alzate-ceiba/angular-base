import { HttpService } from 'src/app/core/services/http.service';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';

import { CrearPrestamosComponent } from './crear-prestamos.component';
import { CommonModule } from '@angular/common';
// import { HttpClientModule } from '@angular/common/http';

describe('CrearPrestamosComponent', () => {
  let component: CrearPrestamosComponent;
  let fixture: ComponentFixture<CrearPrestamosComponent>;

  const ISBN = 'A874478A';
  const NOMBRE_PRESTADO = 'Felipe Alzate'

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CrearPrestamosComponent ],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientModule
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
    component.prestamoForm.controls.nombre.setValue(NOMBRE_PRESTADO);
    expect(component.prestamoForm.valid).toBeFalsy();
  });

  it('si libro no está prestado, crear nuevo prestamo', () => {
    component.prestamoForm.controls.isbn.setValue(ISBN);
    component.prestamoForm.controls.nombre.setValue(NOMBRE_PRESTADO);
    // component.prestar();

    expect(component.prestar()).toBeUndefined();
  });
});
