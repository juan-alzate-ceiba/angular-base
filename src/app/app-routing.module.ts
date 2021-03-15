import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SecurityGuard } from '@core/guard/security.guard';
import { HomeComponent } from '@home/home.component';
import { InternacionalizacionComponent } from './feature/internacionalizacion/internacionalizacion.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, canActivate: [SecurityGuard] },
  { path: 'prestamos', loadChildren: () => import('@prestamos/prestamos.module').then(mod => mod.PrestamosModule) },
  { path: 'libros', loadChildren: () => import('@libros/libros.module').then(m => m.LibrosModule) },
  { path: 'internacionalizacion', component: InternacionalizacionComponent, canActivate: [SecurityGuard] },
  { path: 'login', loadChildren: () => import('./feature/account/account.module').then(m => m.AccountModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
