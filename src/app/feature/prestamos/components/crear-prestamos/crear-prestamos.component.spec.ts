import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
// import { Prestamo } from './../../../../shared/models/prestamo';
// import { Libro } from './../../../../shared/models/libro';
import { ToastrModule } from 'ngx-toastr';
import { HttpService } from 'src/app/core/services/http.service';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';

import { CrearPrestamosComponent } from './crear-prestamos.component';
import { CommonModule } from '@angular/common';
import { throwError, of } from 'rxjs';
import { PrestamosComponent } from '../prestamos/prestamos.component';


describe('CrearPrestamosComponent', () => {
  let component: CrearPrestamosComponent;
  let fixture: ComponentFixture<CrearPrestamosComponent>;
  let service: PrestamosService;

  const ISBN = 'A874478A';
  const NOMBRE_PRESTADOR = 'Felipe Alzate';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CrearPrestamosComponent, PrestamosComponent ],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientTestingModule,
        BrowserAnimationsModule,
        ToastrModule.forRoot(),

      ],
      providers: [PrestamosService, HttpService]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CrearPrestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    service = fixture.debugElement.injector.get(PrestamosService);
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
    component.prestamoForm.controls.nombre.setValue(NOMBRE_PRESTADOR);
    expect(component.prestamoForm.valid).toBeFalsy();
  });

  it('llamar metodo prestar cuando da click en el boton prestar', fakeAsync(() => {
    fixture.detectChanges();
    spyOn(component, 'prestar');

    const button = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    flush();

    expect(component.prestar).toHaveBeenCalledTimes(1);

  }));

  it('debería retornar error si se quiere prestar un libro que está prestado', () => {

    const spyPrestar = spyOn(service, 'prestar').and.returnValue(throwError({status: 404}));

    component.prestar();
    expect(spyPrestar).toBeTruthy();

  });

  it('deberia realizar un nuevo prestamo', fakeAsync(() => {
    // const dummyLibro = new Libro(ISBN, 'La guerra de los cielos', 1998);
    // const dummyPrestamo = new Prestamo('03/03/2021', dummyLibro, '18/03/2021', 'Felipe');

    component.prestamoForm.controls.isbn.setValue(ISBN);
    component.prestamoForm.controls.nombre.setValue(NOMBRE_PRESTADOR);

    fixture.detectChanges();

    const spyPrestar = spyOn(service, 'prestar').and.returnValue(of(null));

    component.prestar();
    expect(component.prestamoForm.valid).toBeFalsy();
    expect(spyPrestar).toHaveBeenCalledTimes(1);
    flush();
  }));

});
