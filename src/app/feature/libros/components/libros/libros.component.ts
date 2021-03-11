import { ToastrService } from 'ngx-toastr';
import { LibrosService } from './../../shared/services/libros.service';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { Libro } from '@shared/models/libro';

const LONGITUD_MAXIMA_PERMITIDA = 4;

@Component({
  selector: 'app-libros',
  templateUrl: './libros.component.html',
  styleUrls: ['./libros.component.css']
})
export class LibrosComponent implements OnInit {

  libroForm: FormGroup;
  submitted = false;
  libro: Libro;

  constructor(
    private librosService: LibrosService,
    private formBuilder: FormBuilder,
    private mensajeToastService: ToastrService
    ) { }

  ngOnInit(): void {
    this.construirFormularioLibro();
  }

  get f() { return this.libroForm.controls; }

  crear() {
    this.submitted = true;
    if (this.libroForm.invalid) {
      return;
    }

    const libro = this.libroForm.value;

    let fechaActual = new Date();
    let fechaMinima = fechaActual.getFullYear() - (fechaActual.getFullYear() - 1);
    if (libro.anio > fechaActual.getFullYear() || libro.anio < fechaMinima) {
      this.submitted = false;
      this.mensajeToastService.warning('Ingrese un año entre 1 y el año actual.');
      return;
    }

    this.librosService.obtenerLibro(libro.isbn)
    .subscribe( libroPrestado => {
      this.libro = libroPrestado;

      if (!libroPrestado) {
        return this.librosService.crear(libro)
          .subscribe( data => {
            this.submitted = false;
            this.libro = data;
            this.libroForm.reset();
            this.mensajeToastService.success(`El libro código ISBN ${libro.isbn} ha sido creado correctamente`);
          });
      } else {
        this.mensajeToastService.warning(`Ya hay un libro registrado con el código ISBN ${libro.isbn}`);
      }
    });
  }

  private construirFormularioLibro() {
    this.libroForm = this.formBuilder.group({
      'isbn': ['', Validators.required],
      'titulo': ['', Validators.required],
      'anio': ['', [Validators.required, Validators.maxLength(LONGITUD_MAXIMA_PERMITIDA)]]
    });
  }

}
