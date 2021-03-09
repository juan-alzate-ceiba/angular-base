import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PrestamosRoutingModule } from './prestamos-routing.module';
import { PrestamosComponent } from './components/prestamos/prestamos.component';
import { SharedModule } from '@shared/shared.module';
import { CrearPrestamosComponent } from './components/crear-prestamos/crear-prestamos.component';

@NgModule({
  declarations: [
    PrestamosComponent,
    CrearPrestamosComponent,
  ],
  imports: [
    CommonModule,
    PrestamosRoutingModule,
    SharedModule
  ],
  providers: []
})
export class PrestamosModule { }
