import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TranslationComponent } from './translation.component';
import { TranslateModule } from '@ngx-translate/core';

describe('TranslationComponent', () => {
  let component: TranslationComponent;
  let fixture: ComponentFixture<TranslationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ TranslationComponent ],
      imports: [TranslateModule.forRoot()]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TranslationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
