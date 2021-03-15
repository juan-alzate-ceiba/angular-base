import { ToastrService } from 'ngx-toastr';
import { Prestamo } from './../../../../shared/models/prestamo';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';


@Component({
  selector: 'app-crear-prestamos',
  templateUrl: './crear-prestamos.component.html',
  styleUrls: ['./crear-prestamos.component.css']
})
export class CrearPrestamosComponent implements OnInit {

  prestamoForm: FormGroup;
  submitted = false;

  prestamo: Prestamo;
  status: string;

  constructor(
    private prestamosService: PrestamosService,
    private mensajeToastService: ToastrService
    ) {
    }

  ngOnInit(): void {
    this.construirFormulaioPrestamo();
  }

  get f() { return this.prestamoForm.controls; }

  prestar() {
    this.submitted = true;
    if (this.prestamoForm.invalid) {
      return;
    }

    const prestamo = this.prestamoForm.value;

    this.prestamosService.prestar(prestamo.isbn, prestamo.nombre.toString()).pipe(take(1))
      .subscribe (prest => {
        this.prestamo = prest;
        this.prestamoForm.reset();
        this.submitted = false;
        this.mensajeToastService.success(`El libro con ISBN ${prestamo.isbn} ha sido prestado a ${prestamo.nombre}`);
      });
  }

  private construirFormulaioPrestamo() {
    this.prestamoForm = new FormGroup({
      isbn: new FormControl('', [Validators.required]),
      nombre: new FormControl('', [Validators.required])
    });
  }

}
