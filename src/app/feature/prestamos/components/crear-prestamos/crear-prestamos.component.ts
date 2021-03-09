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

  constructor(private prestamosService: PrestamosService) { }

  ngOnInit(): void {
    this.construirFormulaioPrestamo();
  }

  get f() { return this.prestamoForm.controls; }

  async prestar() {
    this.submitted = true;
    if (!this.prestamoForm.valid) {
      return;
    }

    const prestamo = this.prestamoForm.value
    // const prestamoObj = await this.obternerPrestamoPorISBN(prestamo.isbn);
    this.prestamosService.obtenerPrestamo(prestamo.isbn)
    .subscribe (data => {
      console.log(data);
      this.prestamo = data;

      if (!this.prestamo) {
        this.prestamosService.prestar(prestamo.isbn, prestamo.nombre)
        .subscribe (prest => {
          console.log('El préstamo se ha realizado con éxito.');
          this.prestamo = prest;
          this.prestamoForm.reset();
        },
        err => {
          console.log(err.error.mensaje)
        });
      } else {
        console.log(`El libro con ISBN ${prestamo.isbn} se encuentra en prestamo actualmente`)
      }

    });


  }

  // private obternerPrestamoPorISBN(isbn: string) {
  //   return this.prestamosService.obtenerPrestamo(isbn)
  //   .subscribe (data => {
  //     console.log(data);
  //     this.prestamo = data;
  //   });
  // }

  private construirFormulaioPrestamo() {
    this.prestamoForm = new FormGroup({
      isbn: new FormControl('', [Validators.required]),
      nombre: new FormControl('', [Validators.required])
    });
  }

}
