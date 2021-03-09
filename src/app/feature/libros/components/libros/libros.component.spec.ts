import { HttpClientModule } from '@angular/common/http';
import { HttpService } from 'src/app/core/services/http.service';
import { LibrosService } from './../../shared/services/libros.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibrosComponent } from './libros.component';

describe('LibrosComponent', () => {
  let component: LibrosComponent;
  let fixture: ComponentFixture<LibrosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LibrosComponent ],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientModule
      ],
      providers: [LibrosService, HttpService]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LibrosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formulario vacio es invalido', () => {
    expect(component.libroForm.valid).toBeFalsy();
  });

  it('formulario con campos vacios es invalido', () => {
    component.libroForm.controls.isbn.setValue('A87423Q');
    expect(component.libroForm.valid).toBeFalsy();
    component.libroForm.controls.isbn.setValue('A87423Q');
    component.libroForm.controls.titulo.setValue('Felipe Alzate');
    expect(component.libroForm.valid).toBeFalsy();
    component.libroForm.controls.isbn.setValue('');
    component.libroForm.controls.titulo.setValue('Felipe Alzate');
    component.libroForm.controls.anio.setValue(19982);
    expect(component.libroForm.valid).toBeFalsy();
  });
});
