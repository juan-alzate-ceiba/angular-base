import { CrearPrestamosComponent } from './components/crear-prestamos/crear-prestamos.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrestamosComponent } from './components/prestamos/prestamos.component';

const routes: Routes = [
  {
    path: '',
    component: PrestamosComponent,
    children: [
      {
        path: 'crear',
        component: CrearPrestamosComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PrestamosRoutingModule { }
