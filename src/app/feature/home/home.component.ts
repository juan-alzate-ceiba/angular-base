import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  title = 'Bienvenido a Bibliotecario';
  text = 'Programa para la gestión de prestamos de libros.';

  constructor() { }

  ngOnInit() {
  }

}
