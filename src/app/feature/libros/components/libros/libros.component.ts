import { LibrosService } from './../../shared/services/libros.service';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { Component, OnInit } from '@angular/core';

const LONGITUD_MAXIMA_PERMITIDA = 4;

@Component({
  selector: 'app-libros',
  templateUrl: './libros.component.html',
  styleUrls: ['./libros.component.css']
})
export class LibrosComponent implements OnInit {

  libroForm: FormGroup;
  submitted = false;

  constructor(private librosService: LibrosService, private formBuilder: FormBuilder) { }

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
    let fecha = new Date();
    if (libro.anio> fecha.getFullYear()) {
        throw('no puede ser mayor');
    }

    this.librosService.crear(libro)
    .subscribe( data => {
      console.log(data);
      this.libroForm.reset();
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
