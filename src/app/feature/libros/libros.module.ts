import { LibrosService } from './shared/services/libros.service';
import { SharedModule } from '@shared/shared.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LibrosRoutingModule } from './libros-routing.module';
import { LibrosComponent } from './components/libros/libros.component';


@NgModule({
  declarations: [
    LibrosComponent
  ],
  imports: [
    CommonModule,
    LibrosRoutingModule,
    SharedModule
  ],
  providers: [LibrosService]
})
export class LibrosModule { }
