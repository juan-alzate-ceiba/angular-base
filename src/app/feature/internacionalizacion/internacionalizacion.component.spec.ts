import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InternacionalizacionComponent } from './internacionalizacion.component';
import { TranslateModule } from '@ngx-translate/core';

describe('InternacionalizacionComponent', () => {
  let component: InternacionalizacionComponent;
  let fixture: ComponentFixture<InternacionalizacionComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ InternacionalizacionComponent ],
      imports: [TranslateModule.forRoot()]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InternacionalizacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
