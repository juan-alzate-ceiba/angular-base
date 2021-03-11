import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';
import { HTTP_ERRORES_CODIGO, HTTP_SUCCESS_COD } from './http-codigo-error';

@Injectable()
export class ManejadorError implements ErrorHandler {
  constructor(private mensajeToastService: ToastrService) {}

  handleError(error: string | Error): void {
    let mensajeMostrar = this.mensajePorDefecto(error);
    this.mostrarMensaje(mensajeMostrar);
  }

  private mensajePorDefecto(error) {
    if (error instanceof HttpErrorResponse) {
      if (!navigator.onLine) {
        return HTTP_ERRORES_CODIGO.NO_HAY_INTERNET;
      }
      if (error.hasOwnProperty('status') && error.error.hasOwnProperty('mensaje')) {
        let mensajeError = this.obtenerErrorHttpCode(error.status);
        let mensaje = '';
        switch (mensajeError) {
          case HTTP_ERRORES_CODIGO['400']:
            mensaje = error.error.mensaje;
            break;
          case HTTP_SUCCESS_COD['200']:
            mensaje = mensajeError;
            break;
        }
        return mensaje;
      }
    }
    return error;
  }

  private mostrarMensaje(mensaje): void {
    this.mensajeToastService.info(mensaje);

  }

  public obtenerErrorHttpCode(httpCode: number): string {
    if (HTTP_ERRORES_CODIGO.hasOwnProperty(httpCode)) {
      return HTTP_ERRORES_CODIGO[httpCode.toString()];
    }
    return HTTP_SUCCESS_COD[httpCode.toString()];
  }
}
