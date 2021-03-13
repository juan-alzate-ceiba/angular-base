import { of } from 'rxjs';
import { ToastrModule } from 'ngx-toastr';
import { Libro } from './../../../../shared/models/libro';
import { HttpClientModule } from '@angular/common/http';
import { HttpService } from 'src/app/core/services/http.service';
import { LibrosService } from './../../shared/services/libros.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { ComponentFixture, fakeAsync, TestBed, tick, flush } from '@angular/core/testing';

import { LibrosComponent } from './libros.component';

describe('LibrosComponent', () => {
  let component: LibrosComponent;
  let fixture: ComponentFixture<LibrosComponent>;

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
        HttpClientModule,
        ToastrModule.forRoot()
      ],
      providers: [LibrosService, HttpService]
    })
    .compileComponents()
    .then(() => {
      fixture = TestBed.createComponent(LibrosComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });
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

  it('no se debe crear libro si existe un libro con el mismo cod ISBN', fakeAsync (() => {
    const dummyLibro = new Libro(ISBN, TITULO, ANIO);

    let service = jasmine.createSpyObj('LibrosService', ['obtenerLibro', 'crear']);

    setTimeout(() => {
      service.obtenerLibro.and.returnValue(dummyLibro);

      expect(service.obtenerLibro).toHaveBeenCalled;
      expect(service.crear).toHaveBeenCalledTimes(0);
    }, 1000);
    tick(1000);

    expect(service.crear).toHaveBeenCalledTimes(0);
  }) );

  it('llamar metodo crear cuando da click en el boton', fakeAsync(() => {
    fixture.detectChanges();
    spyOn(component, 'crear');

    let button = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    flush();

    expect(component.crear).toHaveBeenCalledTimes(1);

  }) );

  it('si libro está creado, no crear nuevo libro', (done) => {
    const dummyLibro = new Libro(ISBN, 'La guerra de los cielos', 1998);

    let service = jasmine.createSpyObj('LibrosService', ["obtenerLibro", "crear"]);

    setTimeout(() => {

      service.obtenerPrestamo.and.returnValue(
        of(dummyLibro)
        );

      expect(service.obtenerLibro).toHaveBeenCalledTimes(1);
      expect(service.crear).toHaveBeenCalledTimes(0);
    }, 1000);
    done();
  } );

  it('si libro no está creado, crear nuevo libro', (done) => {
    let service = jasmine.createSpyObj('LibrosService', ["obtenerLibro", "crear"]);

    setTimeout(() => {

      service.obtenerPrestamo.and.returnValue(
        of(null)
        );

      expect(service.obtenerLibro).toHaveBeenCalledTimes(1);
      expect(service.crear).toHaveBeenCalledTimes(1);
    }, 1000);
    done();
  } );
});
