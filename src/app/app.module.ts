import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA, ErrorHandler } from '@angular/core';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { HomeComponent } from '@home/home.component';
import { ProductoModule } from '@producto/producto.module';
import { PrestamosModule } from '@prestamos/prestamos.module';
import { LibrosModule } from './feature/libros/libros.module';
import { CoreModule } from '@core/core.module';
import { CookieService } from 'ngx-cookie-service';


import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslationComponent } from './feature/translation/translation.component';
import { InternacionalizacionComponent } from './feature/internacionalizacion/internacionalizacion.component';
import { ManejadorError } from '@core/interceptor/manejador-error';


	export function HttpLoaderFactory(httpClient: HttpClient) {
	  return new TranslateHttpLoader(httpClient);
	}


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent
	    ,TranslationComponent
	    ,InternacionalizacionComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ProductoModule,
    PrestamosModule,
    LibrosModule,
    ReactiveFormsModule,
    CoreModule
	    ,TranslateModule.forRoot({
	      loader: {
	        provide: TranslateLoader ,
	        useFactory: HttpLoaderFactory,
	        deps: [HttpClient]
	      }
	    })
  ],
  providers: [CookieService, {provide: ErrorHandler, useClass: ManejadorError}],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
