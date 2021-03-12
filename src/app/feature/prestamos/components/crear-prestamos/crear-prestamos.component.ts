import { ToastrService } from 'ngx-toastr';
import { Prestamo } from './../../../../shared/models/prestamo';
import { PrestamosService } from './../../shared/service/prestamos.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';


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
    if (!this.prestamoForm.valid) {
      return;
    }

    const prestamo = this.prestamoForm.value;

    return this.prestamosService.obtenerPrestamo(prestamo.isbn)
    .subscribe (data => {
      this.prestamo = data;

      if (!this.prestamo) {
        return this.prestamosService.prestar(prestamo.isbn, prestamo.nombre.toString())
        .subscribe (prest => {
          this.prestamo = prest;
          this.prestamoForm.reset();
          this.submitted = false;
          this.mensajeToastService.warning(`El libro con ISBN ${prestamo.isbn} ha sido prestado a ${prestamo.nombre}`);
        });
      } else {
        this.mensajeToastService.warning(`El libro con ISBN ${prestamo.isbn} se encuentra en prestamo actualmente`);
      }
    });
  }

  private construirFormulaioPrestamo() {
    this.prestamoForm = new FormGroup({
      isbn: new FormControl('', [Validators.required]),
      nombre: new FormControl('', [Validators.required])
    });
  }

}
